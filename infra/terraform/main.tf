# Terraform configuration for Shomer infrastructure
# This is a skeleton for future cloud deployment

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment and configure for remote state
  # backend "s3" {
  #   bucket         = "shomer-terraform-state"
  #   key            = "prod/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "shomer-terraform-locks"
  # }
}

# Uncomment and configure for AWS deployment
# provider "aws" {
#   region = var.aws_region
# }

# Variables
variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "shomer"
}

# Outputs
output "environment" {
  description = "Current environment"
  value       = var.environment
}

# Future resources to add:
# - VPC and networking
# - ECS/EKS for container orchestration
# - RDS for PostgreSQL
# - ElastiCache for Redis
# - ALB for load balancing
# - ACM for SSL certificates
# - Route53 for DNS
# - S3 for static assets
# - CloudWatch for monitoring
# - Secrets Manager for secrets
# - IAM roles and policies

