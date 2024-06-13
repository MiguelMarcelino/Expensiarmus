package com.spellshare.expensiarmus.ui.group

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.navigation.findNavController
import androidx.recyclerview.widget.RecyclerView
import com.google.firebase.Timestamp
import com.spellshare.expensiarmus.R
import com.spellshare.expensiarmus.data.Group
import java.text.SimpleDateFormat
import java.util.Locale

class GroupAdapter(private val groups: List<Group>) :
    RecyclerView.Adapter<GroupAdapter.GroupViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): GroupViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_group, parent, false)
        return GroupViewHolder(view)
    }

    override fun onBindViewHolder(holder: GroupViewHolder, position: Int) {
        val group = groups[position]
        holder.bind(group)
    }

    override fun getItemCount(): Int = groups.size

    class GroupViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val groupName: TextView = itemView.findViewById(R.id.groupName)
        private val groupDescription: TextView = itemView.findViewById(R.id.groupDescription)
        private val groupOwner: TextView = itemView.findViewById(R.id.groupOwner)

        fun bind(group: Group) {
            groupName.text = group.name
            groupDescription.text = group.description
            groupOwner.text = group.ownerUid

            // Show description only if it's not null or empty
            groupDescription.visibility =
                if (group.description.isNullOrEmpty()) View.GONE else View.VISIBLE

            itemView.setOnClickListener {
                val bundle = Bundle().apply {
                    putString("uid", group.uid)
                    putString("name", group.name)
                    putString("description", group.description)
                    putString("ownerUid", group.ownerUid)
                }
                itemView.findNavController()
                    .navigate(R.id.action_nav_group_to_nav_group_detail, bundle)
            }
        }

        private fun formatTimestamp(timestamp: Timestamp): String {
            val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
            return sdf.format(timestamp.toDate())
        }
    }
}