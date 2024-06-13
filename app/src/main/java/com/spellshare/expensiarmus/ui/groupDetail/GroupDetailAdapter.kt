package com.spellshare.expensiarmus.ui.groupDetail

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.google.firebase.Timestamp
import com.spellshare.expensiarmus.R
import com.spellshare.expensiarmus.data.Group
import java.text.SimpleDateFormat
import java.util.Locale

class GroupDetailAdapter(private val group: Group) :
    RecyclerView.Adapter<GroupDetailAdapter.GroupDetailViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): GroupDetailViewHolder {
        val view =
            LayoutInflater.from(parent.context).inflate(R.layout.item_group_detail, parent, false)
        return GroupDetailViewHolder(view)
    }

    override fun onBindViewHolder(holder: GroupDetailViewHolder, position: Int) {
        holder.bind(group)
    }

    override fun getItemCount(): Int = 1 // We only have one item to display, the group details

    class GroupDetailViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val groupNameDetail: TextView = itemView.findViewById(R.id.groupNameDetail)
        private val groupDescriptionDetail: TextView =
            itemView.findViewById(R.id.groupDescriptionDetail)
        private val groupOwnerDetail: TextView = itemView.findViewById(R.id.groupOwnerDetail)
        private val groupCreatedAtDetail: TextView =
            itemView.findViewById(R.id.groupCreatedAtDetail)
        private val groupUpdatedAtDetail: TextView =
            itemView.findViewById(R.id.groupUpdatedAtDetail)

        fun bind(group: Group) {
            groupNameDetail.text = group.name
            groupDescriptionDetail.text = group.description
            groupOwnerDetail.text = group.ownerUid
            groupCreatedAtDetail.text = formatTimestamp(group.createdAt)
            groupUpdatedAtDetail.text = formatTimestamp(group.updatedAt)

            // Show description only if it's not null or empty
            groupDescriptionDetail.visibility =
                if (group.description.isNullOrEmpty()) View.GONE else View.VISIBLE
        }

        private fun formatTimestamp(timestamp: Timestamp): String {
            val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
            return sdf.format(timestamp.toDate())
        }
    }
}
