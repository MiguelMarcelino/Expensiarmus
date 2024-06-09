package com.example.expensiarmus.data

import com.google.firebase.Timestamp

data class ExpenseItem(
    var uid: String,
    var amount: Double,
    var description: String?,
    var currency: String,
    var status: String,
    var tags: String,
    var ownerId: Long,
    var groupId: Long,
    var createdAt: Timestamp
) {
    constructor(
        amount: Double,
        description: String?,
        currency: String,
        status: String,
        tags: String,
        ownerId: Long,
        groupId: Long
    ): this(
        uid = "",
        amount = amount,
        description = description,
        currency = currency,
        status = status,
        tags = tags,
        ownerId = ownerId,
        groupId = groupId,
        createdAt = Timestamp.now()
    )
}