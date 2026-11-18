output "kubernetes_cluster_name" {
  value       = google_container_cluster.primary.name
  description = "GKE Cluster Name"
}

output "kubernetes_cluster_endpoint" {
  value       = google_container_cluster.primary.endpoint
  description = "GKE Cluster API Server Endpoint"
}

output "redis_host" {
  value       = google_redis_instance.leaderboard_cache.host
  description = "Memorystore Redis Host Endpoint"
}
