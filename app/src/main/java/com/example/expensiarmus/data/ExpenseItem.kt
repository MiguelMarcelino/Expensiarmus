package com.example.expensiarmus.data

import com.google.firebase.Timestamp

data class ExpenseItem(
    var id: Long,
    var amount: Double,
    var description: String?,
    var currency: String,
    var status: String,
    var tags: String,
    var ownerId: Long,
    var groupId: Long,
    var createdAt: Timestamp
)