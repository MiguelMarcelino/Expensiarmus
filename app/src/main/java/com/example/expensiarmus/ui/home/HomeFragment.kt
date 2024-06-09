package com.example.expensiarmus.ui.home

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import com.example.expensiarmus.databinding.FragmentHomeBinding

class HomeFragment : Fragment() {

    private var _binding: FragmentHomeBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentHomeBinding.inflate(inflater, container, false)
        val root: View = binding.root

        val homeViewModel =
            ViewModelProvider(this)[HomeViewModel::class.java]

        val textView: TextView = binding.textHome

        // Observe the expenseOverview LiveData
        homeViewModel.expenseOverview.observe(viewLifecycleOwner) {
            // Update the TextView with the expense overview

            val displayText =
                homeViewModel.user.userName + '\n' + homeViewModel.user.email + '\n' + "Balance:" + '\n' + it
            textView.text = displayText
        }

        return root
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
