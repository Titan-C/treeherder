# -*- coding: utf-8 -*-
# Generated by Django 1.11.11 on 2018-03-28 09:15
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0001_squashed_0022_modify_bugscache_and_bugjobmap'),
    ]

    operations = [
        migrations.CreateModel(
            name='OtherTextLogError',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('line', models.TextField()),
            ],
            options={
                'db_table': 'other_text_log_error',
            },
        ),
    ]
