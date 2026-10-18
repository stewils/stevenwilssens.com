#!/usr/bin/env python3
"""Sends one email through the Zoho mailbox, for the GitHub workflows: they tell Steven
when a pull request carries an updated resume and when the resume is live. The body is
plain text, with an HTML version alongside when --html-file is given (scripts/resume-mail.mjs
writes both).

Environment:
  MAIL_APP_PASSWORD  a Zoho app password for the mailbox (required; without it the
                     script prints a notice and exits 0, so a missing secret never
                     fails a workflow)
  MAIL_FROM, MAIL_TO default steven@wilssens.com
  MAIL_SMTP_HOST     default smtp.zoho.com (smtp.zoho.eu for a mailbox in the EU data centre)

Usage: python3 scripts/send-mail.py --subject "..." --body-file body.txt [--html-file body.html]
"""
import argparse
import os
import smtplib
import sys
from email.message import EmailMessage
from email.utils import formatdate, make_msgid

parser = argparse.ArgumentParser()
parser.add_argument('--subject', required=True)
parser.add_argument('--body-file', required=True)
parser.add_argument('--html-file', help='an HTML version of the same message, sent as the alternative mail clients prefer')
args = parser.parse_args()

password = os.environ.get('MAIL_APP_PASSWORD', '')
sender = os.environ.get('MAIL_FROM') or 'steven@wilssens.com'
recipient = os.environ.get('MAIL_TO') or 'steven@wilssens.com'
host = os.environ.get('MAIL_SMTP_HOST') or 'smtp.zoho.com'
if not password:
    print('::notice::MAIL_APP_PASSWORD is not set; no email sent. Add a Zoho app password as the MAIL_APP_PASSWORD repository secret.')
    sys.exit(0)

with open(args.body_file, encoding='utf-8') as handle:
    body = handle.read()

message = EmailMessage()
message['Subject'] = args.subject
message['From'] = f'steven.wilssens.com <{sender}>'
message['To'] = recipient
message['Date'] = formatdate(localtime=True)
message['Message-ID'] = make_msgid(domain=sender.split('@')[-1])
message.set_content(body)
if args.html_file:
    with open(args.html_file, encoding='utf-8') as handle:
        message.add_alternative(handle.read(), subtype='html')

with smtplib.SMTP_SSL(host, 465, timeout=30) as smtp:
    smtp.login(sender, password)
    smtp.send_message(message)
print(f'Sent "{args.subject}" to {recipient}')
