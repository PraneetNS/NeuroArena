terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }
}

provider "google" {
  project = var.gcp_project_id
  region  = var.primary_region
}

# VPC Network
resource "google_compute_network" "neuroarena_vpc" {
  name                    = "neuroarena-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "neuroarena_subnet" {
  name          = "neuroarena-subnet-primary"
  ip_cidr_range = "10.10.0.0/20"
  region        = var.primary_region
  network       = google_compute_network.neuroarena_vpc.id
}

# GKE Cluster with Agones Game Server Support
resource "google_container_cluster" "primary" {
  name     = "neuroarena-prod-gke"
  location = var.primary_region

  remove_default_node_pool = true
  initial_node_count       = 1
  network                  = google_compute_network.neuroarena_vpc.name
  subnetwork               = google_compute_subnetwork.neuroarena_subnet.name

  addons_config {
    http_load_balancing {
      disabled = false
    }
    horizontal_pod_autoscaling {
      disabled = false
    }
  }
}

# High-Performance Node Pool for ML Simulation Workloads
resource "google_container_node_pool" "primary_nodes" {
  name       = "neuroarena-worker-pool"
  location   = var.primary_region
  cluster    = google_container_cluster.primary.name
  node_count = var.node_count

  autoscaling {
    min_node_count = 3
    max_node_count = 50
  }

  node_config {
    preemptible  = false
    machine_type = "c2-standard-8" # Compute-optimized for low-latency math
    disk_size_gb = 100
    disk_type    = "pd-ssd"

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = {
      role = "game-simulation-fleet"
    }
  }
}

# Managed Memorystore Redis Cluster
resource "google_redis_instance" "leaderboard_cache" {
  name           = "neuroarena-redis-cluster"
  tier           = "STANDARD_HA"
  memory_size_gb = 16
  region         = var.primary_region
  authorized_network = google_compute_network.neuroarena_vpc.id

  redis_version     = "REDIS_7_0"
  display_name      = "NeuroArena 1M Scaling Redis Cluster"
}
