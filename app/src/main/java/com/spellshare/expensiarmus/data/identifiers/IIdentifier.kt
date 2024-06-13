package com.spellshare.expensiarmus.data.identifiers

interface IIdentifier : Comparable<IIdentifier> {
    val uid: String

    override fun compareTo(other: IIdentifier): Int {
        return uid.compareTo(other.uid)
    }
}