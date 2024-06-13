package com.spellshare.expensiarmus.data

import com.google.firebase.Timestamp
import com.spellshare.expensiarmus.data.identifiers.GroupIdentifier
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
    var ownerIdentifier: UserIdentifier,
    var groupIdentifier: GroupIdentifier,
    var userIdentifiers: List<UserIdentifier>,
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
        ownerIdentifier = UserIdentifier(""),
        groupIdentifier = GroupIdentifier(""),
        userIdentifiers = listOf(),
        createdAt = Timestamp.now()
    )

    constructor(
        amount: Double,
        description: String?,
        currency: String,
        status: String,
        tags: List<String>,
        expenseShare: Map<String, Double>?,
        ownerIdentifier: UserIdentifier,
        groupIdentifier: GroupIdentifier,
        userIdentifiers: List<UserIdentifier>
    ) : this(
        uid = UUID.randomUUID().toString(),
        amount = amount,
        description = description,
        currency = currency,
        status = status,
        tags = tags,
        expenseShare = expenseShare,
        ownerIdentifier = ownerIdentifier,
        groupIdentifier = groupIdentifier,
        userIdentifiers = userIdentifiers,
        createdAt = Timestamp.now()
    )
}