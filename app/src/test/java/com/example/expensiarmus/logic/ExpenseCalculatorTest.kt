package com.example.expensiarmus.logic

import com.example.expensiarmus.data.ExpenseItem
import com.example.expensiarmus.data.User
import com.example.expensiarmus.data.identifiers.GroupIdentifier
import com.google.firebase.Timestamp
import org.junit.Test

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
                tags = "",
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
                tags = "",
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
}