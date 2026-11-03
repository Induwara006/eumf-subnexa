import os
import unittest
from unittest.mock import Mock, patch

import requests

import subnexa_auth


class LoginConfirmationTests(unittest.TestCase):
    @patch.dict(os.environ, {
        "RESEND_API_KEY": "test-key",
        "RESEND_FROM_EMAIL": "SubNexa <login@example.com>",
    })
    @patch("subnexa_auth.requests.post")
    def test_login_confirmation_uses_resend(self, post):
        post.return_value = Mock(ok=True, status_code=200)

        subnexa_auth._send_login_confirmation({
            "name": "<Test User>",
            "email": "user@example.com",
        })

        post.assert_called_once()
        request = post.call_args.kwargs
        self.assertEqual(request["json"]["to"], ["user@example.com"])
        self.assertEqual(request["json"]["from"], "SubNexa <login@example.com>")
        self.assertEqual(request["json"]["subject"], "Welcome to SubNexa")
        self.assertIn("Thank you for joining SubNexa", request["json"]["html"])
        self.assertEqual(request["headers"]["Authorization"], "Bearer test-key")

    @patch.dict(os.environ, {
        "RESEND_API_KEY": "test-key",
        "RESEND_FROM_EMAIL": "SubNexa <login@example.com>",
    })
    @patch("subnexa_auth.requests.post", side_effect=requests.Timeout())
    def test_login_confirmation_failure_does_not_raise(self, _post):
        subnexa_auth._send_login_confirmation({
            "name": "Test User",
            "email": "user@example.com",
        })
