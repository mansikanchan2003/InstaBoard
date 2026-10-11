"""Encryption at rest for Instagram access tokens (``cryptography`` Fernet: AES-128-CBC + HMAC-SHA256).

The key comes from the environment (``INSTAGRAM_TOKEN_ENCRYPTION_KEY``) and is versioned
(``INSTAGRAM_TOKEN_KEY_VERSION``). Each ciphertext row stores the version it was encrypted with, so a key can
be rotated by adding the old key to ``INSTAGRAM_TOKEN_PREVIOUS_KEYS`` ("1:<key>,2:<key>") until every token
has been re-encrypted (tokens are re-encrypted with the current key whenever they are refreshed).
"""

from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import Settings


class TokenDecryptError(Exception):
    """The ciphertext cannot be decrypted with any configured key (wrong/rotated-out key or tampering)."""


class TokenCipher:
    def __init__(self, current_key: str, current_version: int, previous_keys: str | None = None) -> None:
        self.current_version = current_version
        self._keys: dict[int, Fernet] = {current_version: Fernet(current_key.encode())}
        for item in filter(None, (part.strip() for part in (previous_keys or "").split(","))):
            version, _, key = item.partition(":")
            if not version.isdigit() or not key:
                raise ValueError("INSTAGRAM_TOKEN_PREVIOUS_KEYS must look like '1:<fernet-key>,2:<fernet-key>'")
            self._keys.setdefault(int(version), Fernet(key.encode()))

    @classmethod
    def from_settings(cls, settings: Settings) -> TokenCipher:
        if settings.instagram_token_encryption_key is None:
            raise RuntimeError("Instagram token encryption key is not configured")
        previous = settings.instagram_token_previous_keys.get_secret_value() if settings.instagram_token_previous_keys else None
        return cls(settings.instagram_token_encryption_key.get_secret_value(), settings.instagram_token_key_version, previous)

    def encrypt(self, token: str) -> tuple[str, int]:
        return self._keys[self.current_version].encrypt(token.encode()).decode(), self.current_version

    def decrypt(self, ciphertext: str, key_version: int) -> str:
        fernet = self._keys.get(key_version)
        if fernet is None:
            raise TokenDecryptError(f"no key configured for version {key_version}")
        try:
            return fernet.decrypt(ciphertext.encode()).decode()
        except InvalidToken:
            raise TokenDecryptError("ciphertext could not be decrypted") from None
