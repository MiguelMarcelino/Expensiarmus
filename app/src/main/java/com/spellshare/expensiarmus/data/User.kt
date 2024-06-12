package com.spellshare.expensiarmus.data

import com.google.firebase.Timestamp
import java.util.UUID

data class User(
    val uid: String,
    val userName: String,
    val fullName: String,
    val email: String,
    val gender: String,
    val lastLogin: Timestamp,
    val registrationDate: Timestamp
) {

    constructor() : this(
        uid = UUID.randomUUID().toString(),
        userName = "",
        fullName = "",
        email = "",
        gender = "",
        lastLogin = Timestamp.now(),
        registrationDate = Timestamp.now()
    )

    constructor(userName: String, fullName: String, email: String, gender: String) : this(
        uid = UUID.randomUUID().toString(),
        userName = userName,
        fullName = fullName,
        email = email,
        gender = gender,
        lastLogin = Timestamp.now(),
        registrationDate = Timestamp.now()
    )
}