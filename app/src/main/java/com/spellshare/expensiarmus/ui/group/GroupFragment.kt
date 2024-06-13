package com.spellshare.expensiarmus.ui.group

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import com.spellshare.expensiarmus.data.Group
import com.spellshare.expensiarmus.databinding.FragmentGroupBinding
import com.spellshare.expensiarmus.dbconnector.GroupConnector

class GroupFragment : Fragment() {

    private var _binding: FragmentGroupBinding? = null

    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentGroupBinding.inflate(inflater, container, false)
        val root: View = binding.root


        val groupConnector = GroupConnector()
        val groupItems = groupConnector.getItems()
        displayGroups(groupItems)

        return root
    }

    private fun displayGroups(groups: List<Group>) {
        val adapter = GroupAdapter(groups)
        binding.groupRecyclerView.layoutManager = LinearLayoutManager(context)
        binding.groupRecyclerView.adapter = adapter
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

}