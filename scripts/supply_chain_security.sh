#!/bin/bash
# Supply Chain Security: SBOM Generation, Cosign Signing, and SLSA Provenance
# Generates Software Bill of Materials and signs containers with attestations

set -euo pipefail

# Configuration
IMAGE_NAME="${IMAGE_NAME:-ghcr.io/shomer/shomer-api}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
FULL_IMAGE="${IMAGE_NAME}:${IMAGE_TAG}"
COSIGN_KEY="${COSIGN_KEY:-cosign.key}"
SBOM_FILE="sbom.json"
SLSA_PROVENANCE_FILE="slsa-provenance.json"

echo "🔐 Starting Supply Chain Security Process..."
echo "Image: $FULL_IMAGE"
echo "=========================================="

# Function to generate SBOM for backend
generate_backend_sbom() {
    echo "📦 Generating SBOM for backend..."
    
    # Install syft if not available
    if ! command -v syft &> /dev/null; then
        echo "Installing syft for SBOM generation..."
        curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin
    fi
    
    # Generate SBOM for Python dependencies
    cd apps/api
    syft . -o cyclonedx-json > "../$SBOM_FILE"
    cd ../..
    
    echo "✅ Backend SBOM generated: $SBOM_FILE"
}

# Function to generate SBOM for frontend
generate_frontend_sbom() {
    echo "📦 Generating SBOM for frontend..."
    
    # Generate SBOM for Node.js dependencies
    cd apps/web
    syft . -o cyclonedx-json > "../sbom-frontend.json"
    cd ../..
    
    echo "✅ Frontend SBOM generated: sbom-frontend.json"
}

# Function to generate SLSA provenance
generate_slsa_provenance() {
    echo "📋 Generating SLSA provenance..."
    
    cat > "$SLSA_PROVENANCE_FILE" << EOF
{
  "_type": "https://in-toto.io/Statement/v0.1",
  "subject": [
    {
      "name": "$FULL_IMAGE",
      "digest": {
        "sha256": "$(docker inspect $FULL_IMAGE --format='{{index .RepoDigests 0}}' | cut -d'@' -f2)"
      }
    }
  ],
  "predicateType": "https://slsa.dev/provenance/v0.2",
  "predicate": {
    "buildType": "https://github.com/actions/runner@v1",
    "builder": {
      "id": "https://github.com/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"
    },
    "buildConfig": {
      "steps": [
        {
          "command": ["docker", "build", "-t", "$FULL_IMAGE", "."],
          "args": [],
          "env": []
        }
      ]
    },
    "metadata": {
      "buildInvocationId": "$GITHUB_RUN_ID",
      "buildStartedOn": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
      "buildFinishedOn": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
      "completeness": {
        "parameters": true,
        "environment": true,
        "materials": true
      },
      "reproducible": false
    },
    "materials": [
      {
        "uri": "git+https://github.com/$GITHUB_REPOSITORY@$GITHUB_SHA",
        "digest": {
          "sha1": "$GITHUB_SHA"
        }
      }
    ]
  }
}
EOF
    
    echo "✅ SLSA provenance generated: $SLSA_PROVENANCE_FILE"
}

# Function to sign container with Cosign
sign_container() {
    echo "✍️  Signing container with Cosign..."
    
    # Install cosign if not available
    if ! command -v cosign &> /dev/null; then
        echo "Installing cosign..."
        curl -L -o cosign https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64
        chmod +x cosign
        sudo mv cosign /usr/local/bin/
    fi
    
    # Generate cosign key if it doesn't exist
    if [ ! -f "$COSIGN_KEY" ]; then
        echo "Generating Cosign key pair..."
        cosign generate-key-pair
    fi
    
    # Sign the container
    cosign sign --key "$COSIGN_KEY" "$FULL_IMAGE"
    
    echo "✅ Container signed: $FULL_IMAGE"
}

# Function to attach SBOM attestation
attach_sbom_attestation() {
    echo "📎 Attaching SBOM attestation..."
    
    # Attach SBOM as attestation
    cosign attest --predicate "$SBOM_FILE" --type cyclonedx --key "$COSIGN_KEY" "$FULL_IMAGE"
    
    echo "✅ SBOM attestation attached"
}

# Function to attach SLSA provenance attestation
attach_slsa_attestation() {
    echo "📎 Attaching SLSA provenance attestation..."
    
    # Attach SLSA provenance as attestation
    cosign attest --predicate "$SLSA_PROVENANCE_FILE" --type slsaprovenance --key "$COSIGN_KEY" "$FULL_IMAGE"
    
    echo "✅ SLSA provenance attestation attached"
}

# Function to verify signatures and attestations
verify_signatures() {
    echo "🔍 Verifying signatures and attestations..."
    
    # Verify container signature
    cosign verify --key "$COSIGN_KEY" "$FULL_IMAGE"
    
    # Verify SBOM attestation
    cosign verify-attestation --key "$COSIGN_KEY" --type cyclonedx "$FULL_IMAGE"
    
    # Verify SLSA provenance attestation
    cosign verify-attestation --key "$COSIGN_KEY" --type slsaprovenance "$FULL_IMAGE"
    
    echo "✅ All signatures and attestations verified"
}

# Function to publish artifacts
publish_artifacts() {
    echo "📤 Publishing supply chain security artifacts..."
    
    # Create artifacts directory
    mkdir -p artifacts/supply-chain
    
    # Copy SBOM files
    if [ -f "$SBOM_FILE" ]; then
        cp "$SBOM_FILE" "artifacts/supply-chain/"
        echo "✅ Published backend SBOM"
    fi
    
    if [ -f "sbom-frontend.json" ]; then
        cp "sbom-frontend.json" "artifacts/supply-chain/"
        echo "✅ Published frontend SBOM"
    fi
    
    # Copy SLSA provenance
    if [ -f "$SLSA_PROVENANCE_FILE" ]; then
        cp "$SLSA_PROVENANCE_FILE" "artifacts/supply-chain/"
        echo "✅ Published SLSA provenance"
    fi
    
    # Copy cosign public key
    if [ -f "${COSIGN_KEY}.pub" ]; then
        cp "${COSIGN_KEY}.pub" "artifacts/supply-chain/"
        echo "✅ Published Cosign public key"
    fi
}

# Function to generate supply chain report
generate_report() {
    echo ""
    echo "📋 Supply Chain Security Report"
    echo "=========================================="
    
    echo "Image: $FULL_IMAGE"
    echo "Git SHA: ${GITHUB_SHA:-$(git rev-parse HEAD)}"
    echo "Build ID: ${GITHUB_RUN_ID:-local}"
    
    if [ -f "$SBOM_FILE" ]; then
        BACKEND_COMPONENTS=$(jq '.components | length' "$SBOM_FILE" 2>/dev/null || echo "0")
        echo "Backend components: $BACKEND_COMPONENTS"
    fi
    
    if [ -f "sbom-frontend.json" ]; then
        FRONTEND_COMPONENTS=$(jq '.components | length' "sbom-frontend.json" 2>/dev/null || echo "0")
        echo "Frontend components: $FRONTEND_COMPONENTS"
    fi
    
    echo "Container signed: ✅"
    echo "SBOM attestation: ✅"
    echo "SLSA provenance: ✅"
}

# Main execution
main() {
    # Generate SBOMs
    generate_backend_sbom
    generate_frontend_sbom
    
    # Generate SLSA provenance
    generate_slsa_provenance
    
    # Sign container and attach attestations
    sign_container
    attach_sbom_attestation
    attach_slsa_attestation
    
    # Verify everything
    verify_signatures
    
    # Publish artifacts
    publish_artifacts
    
    # Generate report
    generate_report
    
    echo ""
    echo "=========================================="
    echo "🎉 Supply Chain Security process completed"
    echo "🔐 Container signed and attested successfully"
    echo "=========================================="
}

# Run main function
main "$@"
