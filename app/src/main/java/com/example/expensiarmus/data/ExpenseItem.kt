package com.example.expensiarmus.data

data class ExpenseItem(
    val name: String,
    val amount: Double,
    val group: GroupItem,
    val createdBy: User,
    val owedTo: User,
    val owedBy: List<Pair<User, Boolean>>, // Represents the Users who owe and whether they have settled their expense
) {
    fun getUserBalance(user: User): Double {
        // If the user is the one owed, return the amount
        if (user == owedTo) {
            return amount
        }

        // If the user is among those who owe, return their share of the amount
        for ((owingUser, settled) in owedBy) {
            if (user == owingUser && !settled) {
                // Assuming the amount is split equally among all owing users
                val totalOwingUsers = owedBy.size
                return if (totalOwingUsers > 0) -amount / totalOwingUsers else 0.0
            }
        }

        // If the user is neither the one owed nor the ones owing, their balance for this expense is 0
        return 0.0
    }
}