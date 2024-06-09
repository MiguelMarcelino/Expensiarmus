package com.example.expensiarmus.ui.home

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import com.example.expensiarmus.data.ExpenseItem
import com.example.expensiarmus.data.GroupItem
import com.example.expensiarmus.data.User

class HomeViewModel : ViewModel() {

    // MutableLiveData to hold the overview of expenses and groups
    private val _expenseOverview = MutableLiveData<String>()
    val expenseOverview: LiveData<String> = _expenseOverview
}
