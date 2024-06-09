package com.example.expensiarmus.data

import com.google.firebase.Timestamp

data class User(
    val uid: String,
    val userName: String,
    val fullName: String,
    val email: String,
    val gender: String,
    val lastLogin: Timestamp,
    val registrationDate: Timestamp
) {
    constructor(userName: String, fullName: String, email: String, gender: String) : this(
        "",
        userName,
        fullName,
        email,
        gender,
        Timestamp.now(),
        Timestamp.now()
    )
}