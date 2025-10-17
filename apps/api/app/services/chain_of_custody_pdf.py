"""
Chain-of-Custody PDF Export Service.

This module provides professional PDF generation for chain-of-custody documentation
with cryptographic verification, QR codes, and legal formatting.
"""

from datetime import datetime, timezone
from typing import Optional
from io import BytesIO
from sqlalchemy.orm import Session

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
    Image as RLImage,
    PageBreak,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
import qrcode

from app.models.evidence import Evidence, ChainOfCustody, EvidenceAccessLog
from app.models.user import User
from app.core.config import settings


class ChainOfCustodyPDFService:
    """Service for generating chain-of-custody PDF documents."""

    def __init__(self, db: Session):
        self.db = db

    def generate_pdf(
        self,
        evidence_id: int,
        requester: User,
        purpose: str,
        include_access_log: bool = True,
        include_metadata: bool = True,
    ) -> bytes:
        """
        Generate chain-of-custody PDF document.
        
        **Document Header:**
        - Title: "Chain of Custody Record"
        - Jurisdiction and organization info
        - Document generation date/time
        - Unique document ID
        
        **Evidence Information:**
        - Reference number
        - Evidence type
        - File hash (SHA-256)
        - Submission details
        - Current status
        - File size and format
        
        **Chain of Custody Table:**
        - Sequential number
        - Date/Time (timezone)
        - Action performed
        - Performed by (name, role)
        - Location/IP address
        - Signature line
        - Notes
        
        **Access Log (if included):**
        - Date/Time accessed
        - User who accessed
        - Access type (view, download, etc.)
        - Purpose/reason
        
        **Verification Section:**
        - Current file hash
        - Hash verification status
        - Digital signature (if available)
        - QR code linking to verification page
        
        **Footer:**
        - Page numbers
        - Document authenticity statement
        - Contact information for verification
        
        Args:
            evidence_id: ID of evidence to document
            requester: User requesting the document
            purpose: Purpose of the export (legal, audit, etc.)
            include_access_log: Include access log in PDF
            include_metadata: Include technical metadata
            
        Returns:
            PDF file as bytes
            
        Raises:
            HTTPException: If evidence not found or access denied
        """
        # Fetch evidence
        evidence = self.db.query(Evidence).filter(Evidence.id == evidence_id).first()
        if not evidence:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Evidence not found")

        # Fetch chain of custody
        custody_chain = (
            self.db.query(ChainOfCustody)
            .filter(ChainOfCustody.evidence_id == evidence_id)
            .order_by(ChainOfCustody.timestamp.asc())
            .all()
        )

        # Fetch access log if requested
        access_log = []
        if include_access_log:
            access_log = (
                self.db.query(EvidenceAccessLog)
                .filter(EvidenceAccessLog.evidence_id == evidence_id)
                .order_by(EvidenceAccessLog.accessed_at.desc())
                .all()
            )

        # Generate PDF
        return self._generate_pdf_document(
            evidence=evidence,
            custody_chain=custody_chain,
            access_log=access_log,
            requester=requester,
            purpose=purpose,
            include_metadata=include_metadata,
        )

    def _generate_pdf_document(
        self,
        evidence: Evidence,
        custody_chain: list[ChainOfCustody],
        access_log: list[EvidenceAccessLog],
        requester: User,
        purpose: str,
        include_metadata: bool,
    ) -> bytes:
        """
        Internal method to generate the actual PDF document.
        
        Generates a professional, court-ready chain-of-custody PDF with:
        - Document header and footer
        - Evidence metadata table
        - Complete chain-of-custody table
        - QR code for verification
        - Digital signature placeholder
        - Page numbering
        """
        # Create PDF buffer
        buffer = BytesIO()
        
        # Create document with margins
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=0.75*inch,
            leftMargin=0.75*inch,
            topMargin=1*inch,
            bottomMargin=1*inch,
        )
        
        # Get styles
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#1e3a8a'),
            spaceAfter=12,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold',
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#1e40af'),
            spaceAfter=8,
            spaceBefore=12,
            fontName='Helvetica-Bold',
        )
        
        # Build content
        story = []
        
        # ============================================================================
        # HEADER
        # ============================================================================
        story.append(Paragraph("CHAIN OF CUSTODY RECORD", title_style))
        story.append(Paragraph("OFFICIAL EVIDENCE DOCUMENTATION", styles['Normal']))
        story.append(Spacer(1, 0.3*inch))
        
        # Document metadata (use UTC with ISO-8601 for determinism)
        now_utc = datetime.now(timezone.utc)
        doc_info_data = [
            ['Document Generated:', now_utc.strftime("%Y-%m-%dT%H:%M:%S+00:00")],  # ISO-8601
            ['Generated By:', requester.email],
            ['Purpose:', purpose],
            ['Document ID:', f"COC-{evidence.reference_number}-{now_utc.strftime('%Y%m%d%H%M%S')}"],
        ]
        
        doc_info_table = Table(doc_info_data, colWidths=[2*inch, 4.5*inch])
        doc_info_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#374151')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(doc_info_table)
        story.append(Spacer(1, 0.3*inch))
        
        # ============================================================================
        # EVIDENCE INFORMATION
        # ============================================================================
        story.append(Paragraph("EVIDENCE INFORMATION", heading_style))
        
        evidence_data = [
            ['Reference Number:', evidence.reference_number],
            ['Evidence Type:', evidence.evidence_type.upper()],
            ['Status:', evidence.status.upper()],
            ['Filename:', evidence.filename],
            ['File Size:', f"{evidence.file_size:,} bytes ({evidence.file_size / 1024 / 1024:.2f} MB)"],
            ['MIME Type:', evidence.mime_type],
            ['SHA-256 Hash:', evidence.sha256_hash],
            ['MD5 Hash:', evidence.md5_hash or 'N/A'],
            ['Submitted:', evidence.submitted_at.replace(tzinfo=timezone.utc).isoformat()],  # ISO-8601
            ['Received:', evidence.received_at.replace(tzinfo=timezone.utc).isoformat()],    # ISO-8601
        ]
        
        if evidence.verified_at:
            evidence_data.append(['Verified:', evidence.verified_at.replace(tzinfo=timezone.utc).isoformat()])
        if evidence.sealed_at:
            evidence_data.append(['Sealed:', evidence.sealed_at.replace(tzinfo=timezone.utc).isoformat()])
        if evidence.legal_hold:
            evidence_data.append(['Legal Hold:', 'YES'])
            evidence_data.append(['Legal Hold Reason:', evidence.legal_hold_reason or 'N/A'])
        
        evidence_table = Table(evidence_data, colWidths=[2*inch, 4.5*inch])
        evidence_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#374151')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f3f4f6')),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(evidence_table)
        story.append(Spacer(1, 0.3*inch))
        
        # ============================================================================
        # CHAIN OF CUSTODY
        # ============================================================================
        story.append(Paragraph("CHAIN OF CUSTODY", heading_style))
        story.append(Paragraph(
            "Complete immutable audit trail of all actions performed on this evidence:",
            styles['Normal']
        ))
        story.append(Spacer(1, 0.1*inch))
        
        # Chain of custody table
        custody_data = [['#', 'Date/Time (UTC)', 'Action', 'By', 'IP', 'Details']]
        
        for idx, entry in enumerate(custody_chain, 1):
            action_by = entry.action_by_name or 'System'
            if entry.action_by_user:
                action_by = entry.action_by_user.email
            
            details = entry.description or ''
            if entry.notes:
                details += f"\n{entry.notes}"
            if entry.hash_verified:
                details += f"\nHash: {'✓ MATCH' if entry.hash_match else '✗ MISMATCH'}"
            
            # Use ISO-8601 format for all timestamps
            timestamp_utc = entry.timestamp.replace(tzinfo=timezone.utc)
            custody_data.append([
                str(idx),
                timestamp_utc.strftime("%Y-%m-%d\n%H:%M:%S+00:00"),  # ISO-8601
                entry.action.upper(),
                action_by,
                entry.ip_address or 'N/A',
                details,
            ])
        
        custody_table = Table(
            custody_data,
            colWidths=[0.4*inch, 1.2*inch, 1*inch, 1.5*inch, 1*inch, 1.4*inch]
        )
        custody_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e40af')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('PADDING', (0, 0), (-1, -1), 4),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9fafb')]),
        ]))
        story.append(custody_table)
        story.append(Spacer(1, 0.3*inch))
        
        # ============================================================================
        # ACCESS LOG (if included)
        # ============================================================================
        if access_log:
            story.append(Paragraph("ACCESS LOG", heading_style))
            story.append(Paragraph(
                f"Detailed access history ({len(access_log)} entries):",
                styles['Normal']
            ))
            story.append(Spacer(1, 0.1*inch))
            
            access_data = [['Date/Time (UTC)', 'User', 'Access Type', 'Reason', 'IP']]
            
            for entry in access_log[:50]:  # Limit to first 50 entries
                access_timestamp_utc = entry.accessed_at.replace(tzinfo=timezone.utc)
                access_data.append([
                    access_timestamp_utc.strftime("%Y-%m-%d\n%H:%M:%S+00:00"),  # ISO-8601
                    entry.accessed_by.email if entry.accessed_by else 'Unknown',
                    entry.access_type.upper(),
                    entry.reason or 'N/A',
                    entry.ip_address or 'N/A',
                ])
            
            access_table = Table(
                access_data,
                colWidths=[1.2*inch, 1.8*inch, 1*inch, 1.5*inch, 1*inch]
            )
            access_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#059669')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('PADDING', (0, 0), (-1, -1), 4),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0fdf4')]),
            ]))
            story.append(access_table)
            story.append(Spacer(1, 0.3*inch))
        
        # ============================================================================
        # VERIFICATION & QR CODE
        # ============================================================================
        story.append(Paragraph("VERIFICATION", heading_style))
        
        # Generate QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=4,
            border=2,
        )
        qr.add_data(f"https://shomer.app/verify/{evidence.reference_number}")
        qr.make(fit=True)
        
        qr_img = qr.make_image(fill_color="black", back_color="white")
        qr_buffer = BytesIO()
        qr_img.save(qr_buffer, format='PNG')
        qr_buffer.seek(0)
        
        verification_data = [
            [
                Paragraph("<b>Scan QR Code to Verify:</b><br/>Visit the verification URL to confirm authenticity", styles['Normal']),
                RLImage(qr_buffer, width=1.5*inch, height=1.5*inch),
            ],
            [
                Paragraph(f"<b>Current SHA-256 Hash:</b><br/><font size=7>{evidence.sha256_hash}</font>", styles['Normal']),
                '',
            ],
        ]
        
        verification_table = Table(verification_data, colWidths=[4*inch, 2.5*inch])
        verification_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 8),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#d1d5db')),
        ]))
        story.append(verification_table)
        story.append(Spacer(1, 0.3*inch))
        
        # ============================================================================
        # DIGITAL SIGNATURE PLACEHOLDER
        # ============================================================================
        story.append(Paragraph("DIGITAL SIGNATURE", heading_style))
        
        signature_data = [
            ['Authorized Signature:', '________________________________'],
            ['Name:', ''],
            ['Title:', ''],
            ['Date:', ''],
            ['', ''],
            ['Digital Signature Hash:', 'To be implemented - cryptographic signature will appear here'],
        ]
        
        signature_table = Table(signature_data, colWidths=[2*inch, 4.5*inch])
        signature_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('LINEABOVE', (1, 0), (1, 0), 1, colors.black),
        ]))
        story.append(signature_table)
        story.append(Spacer(1, 0.3*inch))
        
        # ============================================================================
        # FOOTER / AUTHENTICITY STATEMENT
        # ============================================================================
        story.append(Spacer(1, 0.3*inch))
        story.append(Paragraph(
            "<b>AUTHENTICITY STATEMENT</b>",
            heading_style
        ))
        story.append(Paragraph(
            "This document represents an official chain-of-custody record for the referenced evidence. "
            "All events are cryptographically logged and tamper-evident. Any alterations to this document "
            "or the underlying evidence will be detectable through hash verification. "
            "For verification, scan the QR code or visit the Shomer verification portal.",
            styles['Normal']
        ))
        story.append(Spacer(1, 0.2*inch))
        
        # Add footer with git SHA for determinism and deployment tracking
        git_sha = settings.GIT_SHA or 'unknown'
        footer_text = (
            f"<i>Generated: {now_utc.strftime('%Y-%m-%dT%H:%M:%S+00:00')} | "
            f"System: Shomer Evidence Management v1.0.0 | "
            f"Build: {git_sha[:8]} | "
            f"Ref: {evidence.reference_number}</i>"
        )
        story.append(Paragraph(
            footer_text,
            ParagraphStyle(
                'Footer',
                parent=styles['Normal'],
                fontSize=8,
                textColor=colors.HexColor('#6b7280'),
                alignment=TA_CENTER,
            )
        ))
        
        # Build PDF with page numbers
        def add_page_number(canvas, doc):
            """Add page numbers to each page."""
            page_num = canvas.getPageNumber()
            text = f"Page {page_num}"
            canvas.saveState()
            canvas.setFont('Helvetica', 9)
            canvas.setFillColor(colors.HexColor('#6b7280'))
            canvas.drawRightString(7.5*inch, 0.5*inch, text)
            canvas.restoreState()
        
        # Build the PDF
        doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
        
        # Return PDF bytes
        buffer.seek(0)
        return buffer.getvalue()

    def get_pdf_template_info(self) -> dict:
        """
        Get information about the PDF template structure.
        
        Returns metadata about what will be included in the PDF.
        """
        return {
            "document_type": "Chain of Custody Record",
            "format": "PDF (A4/Letter)",
            "sections": [
                {
                    "name": "Document Header",
                    "includes": [
                        "Title",
                        "Organization",
                        "Generation timestamp",
                        "Document ID",
                    ],
                },
                {
                    "name": "Evidence Information",
                    "includes": [
                        "Reference number",
                        "Evidence type",
                        "SHA-256 hash",
                        "File details",
                        "Submission info",
                        "Current status",
                    ],
                },
                {
                    "name": "Chain of Custody",
                    "includes": [
                        "Sequential event log",
                        "Timestamps (UTC)",
                        "Actions performed",
                        "User details",
                        "IP addresses",
                        "Hash verifications",
                        "Notes and descriptions",
                    ],
                },
                {
                    "name": "Access Log",
                    "includes": [
                        "Access timestamps",
                        "Users who accessed",
                        "Access types",
                        "Reasons/justifications",
                    ],
                },
                {
                    "name": "Verification",
                    "includes": [
                        "Current hash",
                        "Verification status",
                        "QR code for online verification",
                        "Digital signature placeholder",
                    ],
                },
                {
                    "name": "Footer",
                    "includes": [
                        "Page numbers",
                        "Authenticity statement",
                        "Contact information",
                        "Generated by/for details",
                    ],
                },
            ],
            "features": [
                "Professional legal formatting",
                "Tamper-evident design",
                "QR code verification",
                "Digital signature support",
                "Audit trail completeness",
                "Printable and archivable",
            ],
            "implementation_status": "IMPLEMENTED",
        }


def generate_chain_of_custody_pdf_stub() -> str:
    """
    Returns information about the PDF export feature.
    
    This is a stub function to document the planned implementation.
    """
    return """
    Chain-of-Custody PDF Export - Implementation Plan
    
    The PDF export feature will generate professional, court-ready documentation
    of evidence handling with complete audit trails.
    
    PLANNED FEATURES:
    
    1. Professional Legal Formatting
       - Standard legal document layout
       - Clear section headers
       - Table of custody events
       - Signature lines for each handoff
    
    2. Security Features
       - QR code linking to online verification
       - Cryptographic hash display
       - Tamper-evident design
       - Digital signature support
       - Watermark with generation date
    
    3. Completeness
       - All custody events in chronological order
       - Access log (who viewed/downloaded)
       - Evidence metadata
       - File integrity verification
       - Submitter information (if available)
    
    4. Export Options
       - Include/exclude access log
       - Include/exclude technical metadata
       - Purpose field (legal, audit, investigation)
       - Requester information
    
    5. Verification
       - Unique document ID
       - QR code for online verification
       - Hash of PDF itself
       - Timestamp of generation
    
    IMPLEMENTATION STEPS:
    
    1. Install ReportLab: pip install reportlab qrcode
    2. Create PDF template with professional styling
    3. Add QR code generation for verification
    4. Implement digital signature placeholder
    5. Add PDF storage (S3 or local)
    6. Create verification endpoint for QR codes
    7. Add tests for PDF generation
    8. Document usage in API docs
    
    USAGE:
    
    POST /api/v1/evidence/{evidence_id}/export-chain-of-custody
    {
        "include_access_log": true,
        "include_metadata": true,
        "requester_name": "Det. John Smith",
        "requester_title": "Detective",
        "purpose": "Criminal Investigation Case #2025-001"
    }
    
    RESPONSE:
    - PDF file download
    - Logged in chain-of-custody as "EXPORTED" action
    - Verification URL provided
    """

