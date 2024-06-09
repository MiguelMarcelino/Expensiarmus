package com.example.expensiarmus.dbconnector

import android.content.ContentValues.TAG
import android.util.Log
import com.example.expensiarmus.data.identifiers.GroupIdentifier
import com.google.firebase.firestore.FirebaseFirestore

class GroupExpenseConnector {

    fun getExpenseForGroup(groupIdentifier: GroupIdentifier) {
        // Get all expenses for a group
        val db = FirebaseFirestore.getInstance()

        db.collection("expenses")
            .whereEqualTo("groupId", groupIdentifier.uid)
            .get()
            .addOnSuccessListener { documents ->
                for (document in documents) {
                    Log.d(TAG, "${document.id} => ${document.data}")
                }
            }
    }
}