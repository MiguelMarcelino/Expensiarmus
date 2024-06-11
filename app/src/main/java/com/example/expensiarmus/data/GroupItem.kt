package com.example.expensiarmus.data

import com.google.firebase.Timestamp

data class GroupItem(
    val uid: String,
    val name: String,
    val description: String?,
    val ownerUid: String,
    val createdAt: Timestamp = Timestamp.now(),
    val updatedAt: Timestamp = Timestamp.now()
) {
    constructor(name: String, description: String?, ownerUid: String) : this(
        uid = "",
        name = name,
        description = description,
        ownerUid = ownerUid,
        createdAt = Timestamp.now(),
        updatedAt = Timestamp.now()
    )

    constructor(uid: String, name: String, description: String?, ownerUid: String) : this(
        uid = uid,
        name = name,
        description = description,
        ownerUid = ownerUid,
        createdAt = Timestamp.now(),
        updatedAt = Timestamp.now()
    )
}
