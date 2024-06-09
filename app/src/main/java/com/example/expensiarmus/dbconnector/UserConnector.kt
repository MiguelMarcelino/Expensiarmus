package com.example.expensiarmus.dbconnector

import android.content.ContentValues
import android.util.Log
import com.example.expensiarmus.data.identifiers.UserIdentifier
import com.google.firebase.firestore.FirebaseFirestore

class UserConnector {

    fun updateUser(
        userIdentifier: UserIdentifier,
        name: String? = null,
        email: String? = null,
        gender: String? = null
    ) {
        val db = FirebaseFirestore.getInstance()

        // Create a map of fields to update
        val updates = mutableMapOf<String, Any>()
        name?.let { updates["name"] = it }
        email?.let { updates["email"] = it }
        gender?.let { updates["gender"] = it }

        // Update the document
        db.collection("users")
            .document(userIdentifier.uid)
            .update(updates)
            .addOnSuccessListener {
                Log.d(ContentValues.TAG, "User updated successfully")
            }
            .addOnFailureListener { e ->
                Log.w(ContentValues.TAG, "Error updating user", e)
            }
    }
}