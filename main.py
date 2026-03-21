import sqlite3
import os
from flask import Flask, request, jsonify, render_template, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

app = Flask(__name__, static_folder='static', template_folder='templates')

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bank.db')


# ─── Database Setup ────────────────────────────────────────────────────────────

def get_db():
    """Get a database connection with row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Initialize the database tables."""
    conn = get_db()
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS accounts (
            acc_no       INTEGER PRIMARY KEY,
            name         TEXT    NOT NULL,
            acc_type     TEXT    NOT NULL CHECK(acc_type IN ('S', 'C')),
            balance      REAL    NOT NULL DEFAULT 0,
            pin_hash     TEXT    NOT NULL,
            created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
            updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            acc_no       INTEGER NOT NULL,
            type         TEXT    NOT NULL CHECK(type IN ('deposit', 'withdrawal', 'opening')),
            amount       REAL    NOT NULL,
            balance_after REAL   NOT NULL,
            description  TEXT,
            created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (acc_no) REFERENCES accounts(acc_no) ON DELETE CASCADE
        );
    ''')
    conn.commit()
    conn.close()


def row_to_dict(row):
    """Convert a sqlite3.Row to a dictionary."""
    if row is None:
        return None
    return dict(row)


# ─── Helper Functions ──────────────────────────────────────────────────────────

def validate_pin(pin):
    """Validate that PIN is 4-6 digits."""
    if not pin or not pin.isdigit() or len(pin) < 4 or len(pin) > 6:
        return False
    return True


def verify_account_pin(acc_no, pin):
    """Verify the PIN for an account. Returns (success, account_dict | error_msg)."""
    conn = get_db()
    account = conn.execute('SELECT * FROM accounts WHERE acc_no = ?', (acc_no,)).fetchone()
    conn.close()

    if account is None:
        return False, "Account not found"

    if not check_password_hash(account['pin_hash'], pin):
        return False, "Incorrect PIN"

    return True, row_to_dict(account)


# ─── Routes — Pages ───────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


# ─── Routes — API ─────────────────────────────────────────────────────────────

@app.route('/api/accounts', methods=['POST'])
def create_account():
    """Create a new bank account."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    acc_no = data.get('acc_no')
    name = data.get('name', '').strip()
    acc_type = data.get('acc_type', '').upper()
    deposit = data.get('deposit', 0)
    pin = data.get('pin', '')

    # Validation
    errors = []
    if not acc_no or not isinstance(acc_no, int) or acc_no <= 0:
        errors.append('Valid account number is required (positive integer)')
    if not name:
        errors.append('Account holder name is required')
    if acc_type not in ('S', 'C'):
        errors.append('Account type must be S (Saving) or C (Current)')
    if acc_type == 'S' and deposit < 500:
        errors.append('Minimum deposit for Savings account is ₹500')
    if acc_type == 'C' and deposit < 1000:
        errors.append('Minimum deposit for Current account is ₹1000')
    if not validate_pin(pin):
        errors.append('PIN must be 4-6 digits')

    if errors:
        return jsonify({'error': '; '.join(errors)}), 400

    conn = get_db()
    # Check for duplicate account number
    existing = conn.execute('SELECT acc_no FROM accounts WHERE acc_no = ?', (acc_no,)).fetchone()
    if existing:
        conn.close()
        return jsonify({'error': 'Account number already exists'}), 409

    pin_hash = generate_password_hash(pin)
    now = datetime.utcnow().isoformat()

    try:
        conn.execute(
            'INSERT INTO accounts (acc_no, name, acc_type, balance, pin_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            (acc_no, name, acc_type, deposit, pin_hash, now, now)
        )
        conn.execute(
            'INSERT INTO transactions (acc_no, type, amount, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            (acc_no, 'opening', deposit, deposit, 'Account opening deposit', now)
        )
        conn.commit()
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

    account = row_to_dict(conn.execute('SELECT acc_no, name, acc_type, balance, created_at FROM accounts WHERE acc_no = ?', (acc_no,)).fetchone())
    conn.close()
    return jsonify({'message': 'Account created successfully', 'account': account}), 201


@app.route('/api/accounts', methods=['GET'])
def list_accounts():
    """List all accounts (public info only — no balances)."""
    conn = get_db()
    rows = conn.execute('SELECT acc_no, name, acc_type, created_at FROM accounts ORDER BY created_at DESC').fetchall()
    conn.close()
    accounts = [row_to_dict(r) for r in rows]
    return jsonify({'accounts': accounts})


@app.route('/api/accounts/<int:acc_no>/verify-pin', methods=['POST'])
def verify_pin(acc_no):
    """Verify PIN and return full account details."""
    data = request.get_json()
    pin = data.get('pin', '') if data else ''

    success, result = verify_account_pin(acc_no, pin)
    if not success:
        return jsonify({'error': result}), 403 if result == "Incorrect PIN" else 404

    # Strip pin_hash from response
    result.pop('pin_hash', None)

    # Get recent transactions
    conn = get_db()
    txns = conn.execute(
        'SELECT id, type, amount, balance_after, description, created_at FROM transactions WHERE acc_no = ? ORDER BY created_at DESC LIMIT 20',
        (acc_no,)
    ).fetchall()
    conn.close()

    result['transactions'] = [row_to_dict(t) for t in txns]
    return jsonify({'account': result})


@app.route('/api/accounts/<int:acc_no>/deposit', methods=['POST'])
def deposit(acc_no):
    """Deposit amount into an account."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    pin = data.get('pin', '')
    amount = data.get('amount', 0)

    if not amount or amount <= 0:
        return jsonify({'error': 'Deposit amount must be positive'}), 400

    success, result = verify_account_pin(acc_no, pin)
    if not success:
        return jsonify({'error': result}), 403 if result == "Incorrect PIN" else 404

    new_balance = result['balance'] + amount
    now = datetime.utcnow().isoformat()

    conn = get_db()
    conn.execute('UPDATE accounts SET balance = ?, updated_at = ? WHERE acc_no = ?', (new_balance, now, acc_no))
    conn.execute(
        'INSERT INTO transactions (acc_no, type, amount, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        (acc_no, 'deposit', amount, new_balance, f'Deposit of ₹{amount:,.2f}', now)
    )
    conn.commit()
    conn.close()

    return jsonify({'message': f'₹{amount:,.2f} deposited successfully', 'new_balance': new_balance})


@app.route('/api/accounts/<int:acc_no>/withdraw', methods=['POST'])
def withdraw(acc_no):
    """Withdraw amount from an account."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    pin = data.get('pin', '')
    amount = data.get('amount', 0)

    if not amount or amount <= 0:
        return jsonify({'error': 'Withdrawal amount must be positive'}), 400

    success, result = verify_account_pin(acc_no, pin)
    if not success:
        return jsonify({'error': result}), 403 if result == "Incorrect PIN" else 404

    if amount > result['balance']:
        return jsonify({'error': 'Insufficient balance'}), 400

    new_balance = result['balance'] - amount
    now = datetime.utcnow().isoformat()

    conn = get_db()
    conn.execute('UPDATE accounts SET balance = ?, updated_at = ? WHERE acc_no = ?', (new_balance, now, acc_no))
    conn.execute(
        'INSERT INTO transactions (acc_no, type, amount, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        (acc_no, 'withdrawal', amount, new_balance, f'Withdrawal of ₹{amount:,.2f}', now)
    )
    conn.commit()
    conn.close()

    return jsonify({'message': f'₹{amount:,.2f} withdrawn successfully', 'new_balance': new_balance})


@app.route('/api/accounts/<int:acc_no>', methods=['PUT'])
def modify_account(acc_no):
    """Modify account details."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    pin = data.get('pin', '')
    success, result = verify_account_pin(acc_no, pin)
    if not success:
        return jsonify({'error': result}), 403 if result == "Incorrect PIN" else 404

    name = data.get('name', '').strip()
    acc_type = data.get('acc_type', '').upper()

    errors = []
    if not name:
        errors.append('Account holder name is required')
    if acc_type not in ('S', 'C'):
        errors.append('Account type must be S (Saving) or C (Current)')

    if errors:
        return jsonify({'error': '; '.join(errors)}), 400

    now = datetime.utcnow().isoformat()
    conn = get_db()
    conn.execute('UPDATE accounts SET name = ?, acc_type = ?, updated_at = ? WHERE acc_no = ?',
                 (name, acc_type, now, acc_no))
    conn.commit()

    updated = row_to_dict(conn.execute('SELECT acc_no, name, acc_type, balance, created_at, updated_at FROM accounts WHERE acc_no = ?', (acc_no,)).fetchone())
    conn.close()

    return jsonify({'message': 'Account updated successfully', 'account': updated})


@app.route('/api/accounts/<int:acc_no>', methods=['DELETE'])
def delete_account(acc_no):
    """Close/delete an account."""
    data = request.get_json()
    pin = data.get('pin', '') if data else ''

    success, result = verify_account_pin(acc_no, pin)
    if not success:
        return jsonify({'error': result}), 403 if result == "Incorrect PIN" else 404

    conn = get_db()
    conn.execute('DELETE FROM accounts WHERE acc_no = ?', (acc_no,))
    conn.commit()
    conn.close()

    return jsonify({'message': f'Account {acc_no} closed successfully'})


# ─── Main ──────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    init_db()
    print("\n  🏦  Bank Management System is running!")
    print("  📍  Open http://localhost:5000 in your browser\n")
    app.run(debug=True, host='0.0.0.0', port=5000)