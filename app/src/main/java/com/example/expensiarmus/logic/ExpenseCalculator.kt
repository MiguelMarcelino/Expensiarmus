package com.example.expensiarmus.logic

import com.example.expensiarmus.data.Balance
import com.example.expensiarmus.data.ExpenseItem
import com.example.expensiarmus.data.User
import com.example.expensiarmus.data.identifiers.GroupIdentifier

class ExpenseCalculator {

    fun calculateBalances(users: List<User>, expenses: List<ExpenseItem>, groupId: GroupIdentifier): List<Balance> {
        // A map to store each user's balance
        val userBalances = mutableMapOf<String, Double>()

        // Initialize balances for each user
        users.forEach { user ->
            userBalances[user.uid] = 0.0
        }

        // Calculate total expense and each user's contribution
        expenses.filter { it.groupUid == groupId.uid }.forEach { expense ->
            val ownerId = expense.ownerUid
            // The owner is owed the value of the expense
            userBalances[ownerId] = userBalances[ownerId]?.plus(expense.amount) ?: expense.amount
        }

        val totalExpense = userBalances.values.sum()
        val numUsers = users.size
        val sharePerUser = totalExpense / numUsers

        // Calculate what each user owes or is owed
        userBalances.forEach { (userId, paidAmount) ->
            userBalances[userId] = paidAmount - sharePerUser
        }

        return userBalances.map { Balance(it.key, it.value) }
    }
}