package com.spellshare.expensiarmus.data

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.IgnoreExtraProperties
import com.spellshare.expensiarmus.data.identifiers.UserIdentifier
import java.util.UUID

data class Group(
    val uid: String,
    val name: String,
    val description: String?,
    val ownerUid: String,
    val userIds: List<String>,
    val createdAt: Timestamp = Timestamp.now(),
    val updatedAt: Timestamp = Timestamp.now()
) {
    constructor() : this(
        // create secure random UUID
        uid = UUID.randomUUID().toString(),
        name = "",
        description = "",
        ownerUid = "",
        userIds = listOf(),
        createdAt = Timestamp.now(),
        updatedAt = Timestamp.now()
    )

    constructor(name: String, description: String?, ownerUid: String) : this(
        uid = UUID.randomUUID().toString(),
        name = name,
        description = description,
        ownerUid = ownerUid,
        userIds = listOf(),
        createdAt = Timestamp.now(),
        updatedAt = Timestamp.now()
    )

    constructor(
        uid: String,
        name: String,
        description: String?,
        ownerUid: String,
        userIds: List<String>
    ) : this(
        uid = uid,
        name = name,
        description = description,
        ownerUid = ownerUid,
        userIds = userIds,
        createdAt = Timestamp.now(),
        updatedAt = Timestamp.now()
    )
}
