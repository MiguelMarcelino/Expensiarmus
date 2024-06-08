
The following includes some data for the expenses tables to be created


```sql
CREATE TABLE user (
    id BIGINT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    fullname VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    gender VARCHAR(255),
    last_login TIMESTAMP NOT NULL,
    registration_date TIMESTAMP NOT NULL
);
```

```sql
CREATE TABLE expense (
    id INT PRIMARY KEY,
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP,
    currency VARCHAR(255),
    status VARCHAR(255),
    tags VARCHAR(255),
    -- Other expense details
);
```

```sql
CREATE TABLE user_expense (
    user_id INT,
    expense_id INT,
    FOREIGN KEY (user_id) REFERENCES User(user_id),
    FOREIGN KEY (expense_id) REFERENCES Expense(expense_id),
    PRIMARY KEY (user_id, expense_id)
);
```

```sql 
CREATE TABLE group (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    creator_id BIGINT NOT NULL,
    cover_photo_url TEXT,
    created_at TIMESTAMP NOT NULL,
    FOREIGN KEY (`creator_id`) REFERENCES `User`(`user_id`)
);
```

```sql
CREATE TABLE group_expense (
    id BIGINT,
    group_id BIGINT,
    expense_id BIGINT,
    FOREIGN KEY (group_id) REFERENCES Group(group_id),
    FOREIGN KEY (expense_id) REFERENCES Expense(expense_id),
    PRIMARY KEY (group_id, expense_id)
);
```