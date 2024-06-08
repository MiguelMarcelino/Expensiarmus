package com.example.expensiarmus.data

import java.sql.Timestamp

data class User(
    val id: Int,
    val username: String,
    val fullName: String,
    val email: String,
    val gender: String,
    val lastLogin: Timestamp,
    val registrationDate: Timestamp
)
