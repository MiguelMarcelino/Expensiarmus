package com.example.expensiarmus.ui.groupDetail

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.example.expensiarmus.R
import com.example.expensiarmus.data.ExpenseItem

class ExpenseAdapter(private val expenses: List<ExpenseItem>) : RecyclerView.Adapter<ExpenseAdapter.ExpenseViewHolder>() {
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ExpenseViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.fragment_expense, parent, false)
        return ExpenseViewHolder(view)
    }

    override fun onBindViewHolder(holder: ExpenseViewHolder, position: Int) {
        val expense = expenses[position]
        holder.bind(expense)
    }

    override fun getItemCount() = expenses.size

    class ExpenseViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val descriptionView: TextView = itemView.findViewById(R.id.textExpenseDescription)
        private val amountView: TextView = itemView.findViewById(R.id.textExpenseAmount)
        private val createdAtView: TextView = itemView.findViewById(R.id.textExpenseCreatedAt)
        private val currencyView: TextView = itemView.findViewById(R.id.textExpenseCurrency)

        fun bind(expense: ExpenseItem) {
            descriptionView.text = expense.description
            amountView.text = expense.amount.toString()
            createdAtView.text = expense.createdAt.toString()
            currencyView.text = expense.currency
        }
    }
}