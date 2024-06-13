package com.spellshare.expensiarmus.ui.expenseCreation

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.spellshare.expensiarmus.R
import com.spellshare.expensiarmus.data.Expense

class ExpenseAdapter(private val expenses: List<Expense>) :
    RecyclerView.Adapter<ExpenseAdapter.ExpenseViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ExpenseViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_expense, parent, false)
        return ExpenseViewHolder(view)
    }

    override fun onBindViewHolder(holder: ExpenseViewHolder, position: Int) {
        val expense = expenses[position]
        holder.bind(expense)
    }

    override fun getItemCount(): Int = expenses.size

    class ExpenseViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val expenseIcon: ImageView = itemView.findViewById(R.id.expenseIcon)
        private val expenseDescription: TextView = itemView.findViewById(R.id.expenseDescription)
        private val expenseAmount: TextView = itemView.findViewById(R.id.expenseAmount)

        fun bind(expense: Expense) {
            // Set the expense icon placeholder (ic_placeholder_icon is your placeholder drawable)
            expenseIcon.setImageResource(R.drawable.ic_expense_placeholder)

            expenseDescription.text = expense.description
            expenseAmount.text = "Amount: ${expense.amount}"
            // You can set the expense image using Glide, Picasso, or any other image loading library
            // Example: Glide.with(itemView.context).load(expense.imageUrl).into(expenseImage)
        }
    }
}
