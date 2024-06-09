package com.example.expensiarmus.data

import com.google.firebase.Timestamp

data class User(
    val id: Int,
    val userName: String,
    val fullName: String,
    val email: String,
    val gender: String,
    val lastLogin: Timestamp,
    val registrationDate: Timestamp
) {
    constructor(userName: String, fullName: String, email: String, gender: String) : this(
        -1,
        userName,
        fullName,
        email,
        gender,
        Timestamp.now(),
        Timestamp.now()
    )
}