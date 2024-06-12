package com.spellshare.expensiarmus.ui.home

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel

class HomeViewModel : ViewModel() {

    // MutableLiveData to hold the overview of expenses and groups
    private val _expenseOverview = MutableLiveData<String>()
    val expenseOverview: LiveData<String> = _expenseOverview
}
