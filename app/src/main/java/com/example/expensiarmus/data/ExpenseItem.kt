package com.example.expensiarmus.data

import com.google.firebase.Timestamp

data class ExpenseItem(
    var uid: String,
    var amount: Double,
    var description: String?,
    var currency: String,
    var status: String,
    var tags: String,
    var ownerUid: String,
    var groupUid: String,
    var createdAt: Timestamp
) {
    constructor(
        amount: Double,
        description: String?,
        currency: String,
        status: String,
        tags: String,
        ownerId: String,
        groupId: String
    ) : this(
        uid = "",
        amount = amount,
        description = description,
        currency = currency,
        status = status,
        tags = tags,
        ownerUid = ownerId,
        groupUid = groupId,
        createdAt = Timestamp.now()
    )

    constructor(
        uid: String,
        amount: Double,
        description: String?,
        currency: String,
        status: String,
        tags: String,
        ownerId: String,
        groupId: String
    ) : this(
        uid = uid,
        amount = amount,
        description = description,
        currency = currency,
        status = status,
        tags = tags,
        ownerUid = ownerId,
        groupUid = groupId,
        createdAt = Timestamp.now()
    )
}