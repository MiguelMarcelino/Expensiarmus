package com.example.expensiarmus.data

import com.example.expensiarmus.data.identifiers.UserIdentifier
import java.sql.Timestamp

data class Group(
    val id: Long,
    val name: String,
    val description: String,
    val creatorId: UserIdentifier,
    val coverPhotoUrl: String,
    val createdAt: Timestamp
)
