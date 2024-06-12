package com.spellshare.expensiarmus.logic

import com.spellshare.expensiarmus.data.Balance
import com.spellshare.expensiarmus.data.Debt
import com.spellshare.expensiarmus.data.ExpenseItem
import com.spellshare.expensiarmus.data.User
import com.spellshare.expensiarmus.data.identifiers.GroupIdentifier

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

    fun calculateBalancesAndSettle(users: List<User>, expenses: List<ExpenseItem>, groupIdentifier: GroupIdentifier): List<Debt> {
        val userBalances = mutableMapOf<String, Double>()

        // Initialize balances for each user
        users.forEach { user ->
            userBalances[user.uid] = 0.0
        }

        // Calculate total expense and each user's contribution
        expenses.filter { it.groupUid == groupIdentifier.uid }.forEach { expense ->
            val ownerId = expense.ownerUid
            userBalances[ownerId] = userBalances[ownerId]?.plus(expense.amount) ?: expense.amount
        }

        // Calculate total expense and fair share per user
        val totalExpense = userBalances.values.sum()
        val sharePerUser = totalExpense / users.size

        // Calculate net balances for each user
        users.forEach { user ->
            val paidAmount = userBalances[user.uid] ?: 0.0
            userBalances[user.uid] = paidAmount - sharePerUser
        }

        // Sort users by their balances
        val sortedUsers = userBalances.toList().sortedBy { (_, balance) -> balance }.toMutableList()

        // Settle debts between users
        val debts = mutableListOf<Debt>()
        var leftPointer = 0
        var rightPointer = sortedUsers.size - 1

        while (leftPointer < rightPointer) {
            val (leftUserId, leftBalance) = sortedUsers[leftPointer]
            val (rightUserId, rightBalance) = sortedUsers[rightPointer]

            if (leftBalance == 0.0) {
                leftPointer++
                continue
            }
            if (rightBalance == 0.0) {
                rightPointer--
                continue
            }

            val minAmount = minOf(-leftBalance, rightBalance)

            sortedUsers[leftPointer] = leftUserId to (leftBalance + minAmount)
            sortedUsers[rightPointer] = rightUserId to (rightBalance - minAmount)

            debts.add(Debt(leftUserId, rightUserId, minAmount))

            if (sortedUsers[leftPointer].second == 0.0) leftPointer++
            if (sortedUsers[rightPointer].second == 0.0) rightPointer--
        }

        return debts
    }
}