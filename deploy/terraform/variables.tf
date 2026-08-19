variable "gcp_project_id" {
  type        = string
  description = "GCP Project ID for NeuroArena infrastructure"
  default     = "neuroarena-production"
}

variable "primary_region" {
  type        = string
  description = "Primary deployment cloud region"
  default     = "us-central1"
}

variable "node_count" {
  type        = number
  description = "Initial node count for GKE cluster"
  default     = 6
}
