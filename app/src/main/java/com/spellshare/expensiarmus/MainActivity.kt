package com.spellshare.expensiarmus

import android.os.Bundle
import android.util.Log
import android.view.Menu
import android.view.MenuItem
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.drawerlayout.widget.DrawerLayout
import androidx.navigation.findNavController
import androidx.navigation.fragment.NavHostFragment
import androidx.navigation.ui.AppBarConfiguration
import androidx.navigation.ui.navigateUp
import androidx.navigation.ui.setupActionBarWithNavController
import androidx.navigation.ui.setupWithNavController
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.spellshare.expensiarmus.databinding.ActivityMainBinding
import com.google.firebase.FirebaseApp

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Set up the navigation controller
        val navHostFragment =
            supportFragmentManager.findFragmentById(R.id.nav_host_fragment) as? NavHostFragment
        if (navHostFragment == null) {
            Log.e("MainActivity", "NavHostFragment not found")
            return
        }
        val navController = navHostFragment.navController

        // Set up the bottom navigation bar
        val navView: BottomNavigationView = findViewById(R.id.bottom_navigation)
        navView.setupWithNavController(navController)

        // Set up the app bar
        val toolbar: Toolbar = findViewById(R.id.toolbar)
        setSupportActionBar(toolbar)

        navController.addOnDestinationChangedListener { _, destination, _ ->
            toolbar.title = when (destination.id) {
                R.id.nav_home -> "Home"
                R.id.nav_group -> "Dashboard"
                else -> ""
            }
        }

        // Initialize Firebase
        FirebaseApp.initializeApp(this)
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        // Inflate the menu; this adds items to the action bar if it is present.
        menuInflater.inflate(R.menu.main, menu)

        // Hack to make this be called Home
        val toolbar: Toolbar = findViewById(R.id.toolbar)
        toolbar.title = "Home"

        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            R.id.action_add_group -> {
                // Handle add group action
                true
            }

            R.id.action_search -> {
                // Handle search action
                true
            }

            else -> super.onOptionsItemSelected(item)
        }
    }
}