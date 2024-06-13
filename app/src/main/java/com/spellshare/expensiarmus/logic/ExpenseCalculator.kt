package com.spellshare.expensiarmus.logic

import com.spellshare.expensiarmus.data.Balance
import com.spellshare.expensiarmus.data.Debt
import com.spellshare.expensiarmus.data.Expense
import com.spellshare.expensiarmus.data.User
import com.spellshare.expensiarmus.data.identifiers.GroupIdentifier

class ExpenseCalculator {

    fun calculateBalances(
        users: List<User>,
        expenses: List<Expense>,
        groupId: GroupIdentifier
    ): List<Balance> {
        // A map to store each user's balance
        val userBalances = mutableMapOf<String, Double>()

        // Initialize balances for each user
        users.forEach { user ->
            userBalances[user.uid] = 0.0
        }

        // Calculate total expense and each user's contribution
        expenses.filter { it.groupIdentifier == groupId }.forEach { expense ->
            val ownerId = expense.ownerIdentifier
            // The owner is owed the value of the expense
            userBalances[ownerId.uid] =
                userBalances[ownerId.uid]?.plus(expense.amount) ?: expense.amount
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

    fun calculateDebt(expense: Expense): List<Debt> {
        val userBalances = mutableMapOf<String, Double>()

        val userIdentifiers = expense.userIdentifiers

        // Initialize balances for each user
        userIdentifiers.forEach { userId ->
            userBalances[userId.uid] = 0.0
        }

        // Calculate each user's net balance
        if (expense.expenseShare != null) {
            expense.expenseShare!!.forEach { (userId, sharePercentage) ->
                val shareAmount = expense.amount * sharePercentage
                userBalances[userId] = userBalances[userId]?.minus(shareAmount) ?: -shareAmount
                userBalances[expense.ownerIdentifier.uid] =
                    userBalances[expense.ownerIdentifier.uid]?.plus(shareAmount) ?: shareAmount
            }
        } else {
            // If expenseShare is null, the owner pays the total amount
            userBalances[expense.ownerIdentifier.uid] =
                userBalances[expense.ownerIdentifier.uid]?.plus(expense.amount) ?: expense.amount
        }

        // Calculate total expense and fair share per user
        val totalExpense = userBalances.values.sum()
        val sharePerUser = totalExpense / userIdentifiers.size

        // Calculate net balances for each user
        userIdentifiers.forEach { userId ->
            val paidAmount = userBalances[userId.uid] ?: 0.0
            userBalances[userId.uid] = paidAmount - sharePerUser
        }

        return calculateDebtsFromBalance(userBalances)
    }

    fun calculateAllDebts(expenses: List<Expense>): List<Debt> {
        val aggregateDebts = mutableListOf<Debt>()
        val userBalances = mutableMapOf<String, Double>()

        // Calculate debts for each expense and aggregate them
        expenses.forEach { expense ->
            val debts = calculateDebt(expense)
            aggregateDebts.addAll(debts)
        }

        // Update the user balances based on the debts
        aggregateDebts.forEach { debt ->
            userBalances[debt.debtorUid] =
                userBalances.getOrDefault(debt.debtorUid, 0.0) - debt.amount
            userBalances[debt.creditorUid] =
                userBalances.getOrDefault(debt.creditorUid, 0.0) + debt.amount
        }

        return calculateDebtsFromBalance(userBalances)
    }

    private fun calculateDebtsFromBalance(userBalances: Map<String, Double>): List<Debt> {
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