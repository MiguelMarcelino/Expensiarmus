package com.spellshare.expensiarmus.logic

import com.spellshare.expensiarmus.data.Expense
import com.spellshare.expensiarmus.data.User
import com.spellshare.expensiarmus.data.identifiers.GroupIdentifier
import com.google.firebase.Timestamp
import com.spellshare.expensiarmus.data.Debt
import com.spellshare.expensiarmus.data.identifiers.UserIdentifier
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
            Expense(
                uid = "1",
                amount = 100.0,
                description = "Dinner",
                currency = "USD",
                status = "paid",
                tags = listOf("food"),
                expenseShare = mapOf("1" to 0.5, "2" to 0.5),
                ownerUid = "1",
                groupUid = "1",
                userIdentifiers = listOf("1", "2").map { UserIdentifier(it) },
                createdAt = Timestamp.now()
            ),
            Expense(
                uid = "2",
                amount = 50.0,
                description = "Taxi",
                currency = "USD",
                status = "paid",
                tags = listOf("transportation"),
                expenseShare = mapOf("1" to 0.5, "2" to 0.5),
                ownerUid = "2",
                groupUid = "1",
                userIdentifiers = listOf("1", "2").map { UserIdentifier(it) },
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
            Expense(
                uid = "1",
                amount = 100.0,
                description = "Dinner",
                currency = "USD",
                status = "paid",
                tags = listOf("food"),
                expenseShare = mapOf("1" to 0.5, "2" to 0.5),
                ownerUid = "1",
                groupUid = "1",
                userIdentifiers = listOf("1", "2").map { UserIdentifier(it) },
                createdAt = Timestamp.now()
            ),
            Expense(
                uid = "1",
                amount = 50.0,
                description = "Taxi",
                currency = "USD",
                status = "paid",
                tags = listOf("transportation"),
                expenseShare = mapOf("1" to 0.5, "2" to 0.5),
                ownerUid = "1",
                groupUid = "1",
                userIdentifiers = listOf("1", "2").map { UserIdentifier(it) },
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

        val expenses = listOf<Expense>()

        val expenseCalculator = ExpenseCalculator()

        val balances = expenseCalculator.calculateBalances(users, expenses, GroupIdentifier("1"))

        assert(balances.size == 1)
        assert(balances[0].amount == 0.0)
    }

    @Test
    fun calculateDebtTest() {
        // For simplicity, we gave names to user IDs
        // John = 1, Jane = 2, Bob = 3
        val expenses = listOf(
            Expense(
                uid = "1",
                amount = 50.0,
                description = "Taxi",
                currency = "USD",
                status = "paid",
                tags = listOf("transportation"),
                expenseShare = null,
                ownerUid = "1",
                groupUid = "1",
                userIdentifiers = listOf("1", "2", "3").map { UserIdentifier(it) },
                createdAt = Timestamp.now()
            ),
            Expense(
                uid = "2",
                amount = 50.0,
                description = "Taxi",
                currency = "USD",
                status = "paid",
                tags = listOf("transportation"),
                expenseShare = null,
                ownerUid = "2",
                groupUid = "1",
                userIdentifiers = listOf("1", "2", "3").map { UserIdentifier(it) },
                createdAt = Timestamp.now()
            )
        )

        val expenseCalculator = ExpenseCalculator()

        val debts = expenseCalculator.calculateAllDebts(expenses)

        println(debts)

        // Since Bob owes both John and Jane, the calculation should go as follows
        val bobOwedTotal = 100.0 / 3
        val bobOwedPerUser = bobOwedTotal / 2

        assert(debts.size == 2)
        // Bob owes Jane $16.67
        val janeDept = debts[0]
        assert(janeDept.debtorUid == "3")
        assert(janeDept.creditorUid == "1")
        // Assert that the amount is approximately equal to $16.67
        val amountJane = bobOwedPerUser - janeDept.amount
        assert(abs(amountJane) <= 0.000001)

        // Bob owes John $16.67
        val johnDept = debts[1]
        assert(johnDept.debtorUid == "3")
        assert(johnDept.creditorUid == "2")
        // Assert that the amount is approximately equal to $16.67
        val amountJohn = bobOwedPerUser - johnDept.amount
        assert(abs(amountJohn) <= 0.000001)
    }

    @Test
    fun calculateBalancesAndSettleTest() {
        // For simplicity, we gave names to user IDs
        // John = 1, Jane = 2, Bob = 3
        val expenses = listOf(
            Expense(
                uid = "1",
                amount = 100.0,
                description = "Dinner",
                currency = "USD",
                status = "paid",
                tags = listOf("food"),
                expenseShare = mapOf(
                    "1" to 0.4,  // John pays 40%
                    "2" to 0.4,  // Jane pays 40%
                    "3" to 0.2   // Bob pays 20%
                ),
                ownerUid = "1",
                groupUid = "1",
                userIdentifiers = listOf("1", "2", "3").map { UserIdentifier(it) },
                createdAt = Timestamp.now()
            ),
            Expense(
                uid = "2",
                amount = 50.0,
                description = "Taxi",
                currency = "USD",
                status = "paid",
                tags = listOf("transport"),
                expenseShare = mapOf(
                    "1" to 0.4,  // John pays 40%
                    "2" to 0.2,  // Jane pays 20%
                    "3" to 0.4   // Bob pays 40%
                ),
                ownerUid = "2",
                groupUid = "1",
                userIdentifiers = listOf("1", "2", "3").map { UserIdentifier(it) },
                createdAt = Timestamp.now()
            )
        )

        val expenseCalculator = ExpenseCalculator()

        val debts =
            expenseCalculator.calculateAllDebts(expenses)

        debts.forEach { debt ->
            println("${debt.debtorUid} owes ${debt.creditorUid} ${debt.amount}")
        }

        // Expected debts:
        // John paid 100 euros
        //  - Bob pays 20
        //  - Jane pays 40
        // Jane paid 50 euros
        //  - Bob pays 20
        //  - John pays 20
        //
        // Jane was going to pay 20 euros to John, and Bob was going to pay 20 euros to Jane and 20 euros to John,
        // To minimize transactions, Bob pays 40 euros to John

        assert(debts.size == 1)
        assert(debts.contains(Debt("3", "1", 40.0)))
    }
}