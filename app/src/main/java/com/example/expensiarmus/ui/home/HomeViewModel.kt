package com.example.expensiarmus.ui.home

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import com.example.expensiarmus.data.ExpenseItem
import com.example.expensiarmus.data.GroupItem
import com.example.expensiarmus.data.User

class HomeViewModel : ViewModel() {

    // Sample data for expenses and groups (replace with actual data source)
    // TODO: Replace with your data. Make call to Firebase
    val user = User(
        userName = "dummyUser1",
        email = "dummy.user@somnus.com",
        fullName = "Joe Mama",
        gender = "other"
    )
    val user2 = User(
        userName = "Dummy User 2",
        email = "dummy2.user@somnus.com",
        fullName = "Joe Papa",
        gender = "other"
    )
    private val sampleExpenses = listOf(
        ExpenseItem(
            "Expense 1",
            100.0,
            GroupItem(1, "Group A", "Example First Group"), user, user2, listOf(Pair(user, false))
        ),
        ExpenseItem(
            "Expense 2",
            50.0,
            GroupItem(2, "Group B", "Example Second Group"),
            user,
            user2,
            listOf(Pair(user, true))
        ),
        ExpenseItem(
            "Expense 3",
            75.0,
            GroupItem(3, "Group C", "Example Third Group"),
            user,
            user,
            listOf(Pair(user, false))
        ),
        ExpenseItem(
            "Expense 4",
            120.0,
            GroupItem(4, "Group D", "Example Fourth Group"),
            user,
            user,
            listOf(Pair(user, false))
        )
    )

    // MutableLiveData to hold the overview of expenses and groups
    private val _expenseOverview = MutableLiveData<String>()
    val expenseOverview: LiveData<String> = _expenseOverview

    init {
        // Calculate and update the expense overview when the ViewModel is created
        val res = StringBuilder()
        for (expense in sampleExpenses) {
            res.append(expense.group.name + ":" + expense.getUserBalance(user) + '\n')
        }
        _expenseOverview.value = res.toString().trim()
    }
}
