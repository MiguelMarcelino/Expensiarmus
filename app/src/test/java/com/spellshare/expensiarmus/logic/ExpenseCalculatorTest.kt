package com.spellshare.expensiarmus.logic

import com.spellshare.expensiarmus.data.ExpenseItem
import com.spellshare.expensiarmus.data.User
import com.spellshare.expensiarmus.data.identifiers.GroupIdentifier
import com.google.firebase.Timestamp
import org.junit.Test
import kotlin.math.abs

class ExpenseCalculatorTest {

    @Test
    fun calculateBalancesTest() {
        val users = listOf(
            User(
                uid = "1",
                userName = "john_doe",
                fullName = "John Doe",
                email = "john@example.com",
                gender = "male",
                lastLogin = Timestamp.now(),
                registrationDate = Timestamp.now()
            ),
            User(
                uid = "2",
                userName = "jane_doe",
                fullName = "Jane Doe",
                email = "jane@example.com",
                gender = "female",
                lastLogin = Timestamp.now(),
                registrationDate = Timestamp.now()
            )
        )

        val expenses = listOf(
            ExpenseItem(
                uid = "1",
                amount = 100.0,
                description = "Dinner",
                currency = "USD",
                status = "paid",
                tags = listOf("food"),
                ownerUid = "1",
                groupUid = "1",
                createdAt = Timestamp.now()
            ),
            ExpenseItem(
                uid = "2",
                amount = 50.0,
                description = "Taxi",
                currency = "USD",
                status = "paid",
                tags = listOf("transportation"),
                ownerUid = "2",
                groupUid = "1",
                createdAt = Timestamp.now()
            )
        )

        val expenseCalculator = ExpenseCalculator()

        val balances = expenseCalculator.calculateBalances(users, expenses, GroupIdentifier("1"))

        assert(balances.size == 2)
        assert(balances[0].amount == 25.0)
        assert(balances[1].amount == -25.0)
    }

    @Test
    fun calculateBalancesTestWithOneUser() {
        val users = listOf(
            User(
                uid = "1",
                userName = "john_doe",
                fullName = "John Doe",
                email = "john@example.com",
                gender = "male",
                lastLogin = Timestamp.now(),
                registrationDate = Timestamp.now()
            )
        )

        val expenses = listOf(
            ExpenseItem(
                uid = "1",
                amount = 100.0,
                description = "Dinner",
                currency = "USD",
                status = "paid",
                tags = listOf("food"),
                ownerUid = "1",
                groupUid = "1",
                createdAt = Timestamp.now()
            ),
            ExpenseItem(
                uid = "1",
                amount = 50.0,
                description = "Taxi",
                currency = "USD",
                status = "paid",
                tags = listOf("transportation"),
                ownerUid = "1",
                groupUid = "1",
                createdAt = Timestamp.now()
            )
        )

        val expenseCalculator = ExpenseCalculator()

        val balances = expenseCalculator.calculateBalances(users, expenses, GroupIdentifier("1"))

        assert(balances.size == 1)
        assert(balances[0].amount == 0.0)
    }

    @Test
    fun calculateBalancesTestWithNoExpenses() {
        val users = listOf(
            User(
                uid = "1",
                userName = "john_doe",
                fullName = "John Doe",
                email = "john@example.com",
                gender = "male",
                lastLogin = Timestamp.now(),
                registrationDate = Timestamp.now()
            )
        )

        val expenses = listOf<ExpenseItem>()

        val expenseCalculator = ExpenseCalculator()

        val balances = expenseCalculator.calculateBalances(users, expenses, GroupIdentifier("1"))

        assert(balances.size == 1)
        assert(balances[0].amount == 0.0)
    }

    @Test
    fun calculateDebtTest() {
        val users = listOf(
            User(
                uid = "1",
                userName = "john_doe",
                fullName = "John Doe",
                email = "john@example.com",
                gender = "male",
                lastLogin = Timestamp.now(),
                registrationDate = Timestamp.now()
            ),
            User(
                uid = "2",
                userName = "jane_doe",
                fullName = "Jane Doe",
                email = "jane@example.com",
                gender = "female",
                lastLogin = Timestamp.now(),
                registrationDate = Timestamp.now()
            ),
            User(
                uid = "3",
                userName = "bob",
                fullName = "Bob Smith",
                email = "bob@example.com",
                gender = "male",
                lastLogin = Timestamp.now(),
                registrationDate = Timestamp.now()
            )
        )

        val expenses = listOf(
            ExpenseItem(
                uid = "1",
                amount = 50.0,
                description = "Taxi",
                currency = "USD",
                status = "paid",
                tags = listOf("transportation"),
                ownerUid = "1",
                groupUid = "1",
                createdAt = Timestamp.now()
            ),
            ExpenseItem(
                uid = "2",
                amount = 50.0,
                description = "Taxi",
                currency = "USD",
                status = "paid",
                tags = listOf("transportation"),
                ownerUid = "2",
                groupUid = "1",
                createdAt = Timestamp.now()
            )
        )

        val expenseCalculator = ExpenseCalculator()

        val debts =
            expenseCalculator.calculateBalancesAndSettle(users, expenses, GroupIdentifier("1"))

        println(debts)

        // Since Bob owes both John and Jane, the calculation should go as follows
        val bobOwedTotal = 100.0 / 3
        val bobOwedPerUser = bobOwedTotal / 2

        println(bobOwedPerUser)

        assert(debts.size == 2)
        // Bob owes Jane $16.67
        val janeDept = debts[0]
        assert(janeDept.debtorUid == "3")
        assert(janeDept.creditorUid == "2")
        // Assert that the amount is approximately equal to $16.67
        val amountJane = bobOwedPerUser - janeDept.amount
        assert(abs(amountJane) <= 0.000001)

        // Bob owes John $16.67
        val johnDept = debts[1]
        assert(johnDept.debtorUid == "3")
        assert(johnDept.creditorUid == "1")
        // Assert that the amount is approximately equal to $16.67
        val amountJohn = bobOwedPerUser - johnDept.amount
        assert(abs(amountJohn) <= 0.000001)
    }
}