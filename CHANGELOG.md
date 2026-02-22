# Changelog

All notable changes to the Dynamics 365 Flow History Extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2] - 2025-01-XX

### Added
- Input validation for Azure AD Client ID (GUID format required)
- Input validation for Tenant ID (accepts 'common' or valid GUID)
- Inline error messages in the Setup Flow Monitor dialog
- Real-time validation feedback with visual indicators

### Changed
- Improved error messaging for configuration issues
- Enhanced user experience for first-time setup

### Fixed
- Configuration form now properly validates before saving

## [2.1] - Previous Release

### Added
- Record-specific flow run filtering
- "This Record" and "Failed (This)" streaming search
- Environment-aware tenant ID placeholder
- Gear icon for manual configuration access

### Changed
- Improved token caching with automatic refresh on 401
- Better pagination support for flow run lists

## [2.0] - Major Release

### Added
- Shadow DOM isolation for UI styles
- Three-tab interface: Triggered By, Modified By, Read By
- Flow status filtering (All, Active, Draft)
- Search functionality for flows
- System flow detection and labeling
- Navigation polling with debouncing

### Changed
- Complete UI redesign with Fluent Design principles
- Migrated to Manifest V3
- Improved message bridge architecture (MAIN/ISOLATED worlds)

### Security
- Proper world isolation for content scripts
- Token caching with expiration handling

## [1.0] - Initial Release

### Added
- Basic flow history viewing for Dynamics 365 records
- Azure AD authentication via OAuth 2.0
- Extension popup with settings management
- Options page for configuration
