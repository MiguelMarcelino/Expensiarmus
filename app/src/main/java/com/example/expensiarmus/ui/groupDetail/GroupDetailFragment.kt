package com.example.expensiarmus.ui.groupDetail

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import com.example.expensiarmus.databinding.FragmentDetailBinding

class GroupDetailFragment : Fragment() {

    private var _binding: FragmentDetailBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        _binding = FragmentDetailBinding.inflate(inflater, container, false)
        val root: View = binding.root

        val id = arguments?.getInt("id")
        val name = arguments?.getString("name")
        val description = arguments?.getString("description")

        binding.textId.text = id.toString()
        binding.textName.text = name
        binding.textDescription.text = description

        return root
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

}