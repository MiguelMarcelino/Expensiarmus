package com.example.expensiarmus.data

data class GroupItem(
    val id: Long,
    val name: String,
    val description: String,
    val expenses: MutableList<ExpenseItem> = mutableListOf()
) {
    // Function to add an expense to the group
    fun addExpense(expense: ExpenseItem) {
        expenses.add(expense)
    }
}
