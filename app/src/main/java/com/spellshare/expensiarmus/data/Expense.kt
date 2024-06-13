package com.spellshare.expensiarmus.data

import com.google.firebase.Timestamp
import com.spellshare.expensiarmus.data.identifiers.UserIdentifier
import java.util.UUID

data class Expense(
    var uid: String,
    var amount: Double,
    var description: String?,
    var currency: String,
    var status: String,
    var tags: List<String>,
    var expenseShare: Map<String, Double>?,
    var ownerUid: String,
    var groupUid: String,
    var userUids: List<String>,
    var createdAt: Timestamp
) {
    constructor() : this(
        uid = UUID.randomUUID().toString(),
        amount = 0.0,
        description = "",
        currency = "",
        status = "",
        tags = listOf(),
        expenseShare = mapOf(),
        ownerUid = "",
        groupUid = "",
        userUids = listOf(),
        createdAt = Timestamp.now()
    )

    constructor(
        amount: Double,
        description: String?,
        currency: String,
        status: String,
        tags: List<String>,
        expenseShare: Map<String, Double>?,
        ownerUid: String,
        groupUid: String,
        userUids: List<String>
    ) : this(
        uid = UUID.randomUUID().toString(),
        amount = amount,
        description = description,
        currency = currency,
        status = status,
        tags = tags,
        expenseShare = expenseShare,
        ownerUid = ownerUid,
        groupUid = groupUid,
        userUids = userUids,
        createdAt = Timestamp.now()
    )
}