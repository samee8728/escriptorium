# Generated by Django 2.1.4 on 2020-09-17 13:02
import uuid

from django.db import migrations


def forward(apps, se):
    Block = apps.get_model('core', 'Block')
    Line = apps.get_model('core', 'Line')

    for block in Block.objects.filter(external_id=None):
        block.external_id = 'eSc_textblock_%s' % str(uuid.uuid4())[:8]
        block.save()

    for line in Line.objects.filter(external_id=None):
        line.external_id = 'eSc_line_%s' % str(uuid.uuid4())[:8]
        line.save()


def backward(apps, se):
    # no need to do anything
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0040_link_default_typology'),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
