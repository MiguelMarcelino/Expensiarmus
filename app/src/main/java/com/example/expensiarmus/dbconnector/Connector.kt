package com.example.expensiarmus.dbconnector

import com.example.expensiarmus.data.identifiers.IIdentifier
import com.example.expensiarmus.data.identifiers.UserIdentifier

interface Connector<A> {

    fun  <T : IIdentifier> getItem(identifier: T): A?

    fun getItems(): List<A>

    fun addItem(item: A)

    fun updateItem(item: A)

    fun <T : IIdentifier> deleteItem(identifier: T)
}
