package com.spellshare.expensiarmus.data

import com.google.firebase.Timestamp
import java.util.UUID

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
    constructor() : this(
        uid = UUID.randomUUID().toString(),
        amount = 0.0,
        description = "",
        currency = "",
        status = "",
        tags = "",
        ownerUid = "",
        groupUid = "",
        createdAt = Timestamp.now()
    )

    constructor(
        amount: Double,
        description: String?,
        currency: String,
        status: String,
        tags: String,
        ownerId: String,
        groupId: String
    ) : this(
        uid = UUID.randomUUID().toString(),
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