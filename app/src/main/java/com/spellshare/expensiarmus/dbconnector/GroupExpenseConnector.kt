package com.spellshare.expensiarmus.dbconnector

import com.spellshare.expensiarmus.data.Expense
import com.spellshare.expensiarmus.data.identifiers.GroupIdentifier
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await

object GroupExpenseConnector {

    fun getExpenseForGroup(groupIdentifier: GroupIdentifier): List<Expense> {
        // Get all expenses for a group
        val db = FirebaseFirestore.getInstance()
        val deferred = CompletableDeferred<List<Expense>>()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val documents = db.collection("expenses")
                    .whereEqualTo("groupId", groupIdentifier.uid)
                    .get()
                    .await()
                val expenses = documents.map { document ->
                    document.toObject(Expense::class.java)
                }
                deferred.complete(expenses)
            } catch (e: Exception) {
                deferred.completeExceptionally(e)
            }
        }

        return runBlocking { deferred.await() }
    }
}